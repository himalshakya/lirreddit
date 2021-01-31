import { User } from "../entities/User";
import { MyContext } from "src/types";
import { Arg, Ctx, Field, Int, Mutation, ObjectType, Query, Resolver } from "type-graphql";
import argon2  from "argon2";
import { EntityManager } from "@mikro-orm/postgresql"
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "../constants";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { validateRegister } from "../utils/validateRegister";
import { sendEmail } from "../utils/sendEmails";
import { v4 } from "uuid";

@ObjectType()
class FieldError {
    @Field()
    field: string
    @Field()
    message: string
}

@ObjectType()
class UserResponse {
    @Field(() => [FieldError], {nullable: true})
    errors?: FieldError[]

    @Field(() => User, { nullable: true})
    user?: User
}

@Resolver()
export class UserResolver {

    @Query(() => User, { nullable: true})
    async me(
        @Ctx() { em, req}: MyContext
    ){
        if (!req.session.userId){
            return null
        }
        const user = await em.findOne(User, { id: req.session.userId });
        return user
    }

    @Mutation(() => UserResponse)
    async register(
        @Arg("options") options: UsernamePasswordInput,
        @Ctx() { em, req }: MyContext
    ): Promise<UserResponse>{
        const errors = validateRegister(options)
        if (errors){
            return { errors }
        }

        const hashedPassword = await argon2.hash(options.password)
        // const user = em.create(User, { username: options.username, password: hashedPassword })
        let user;
        try{
            const result = await (em as EntityManager).createQueryBuilder(User).getKnexQuery().insert({
                username: options.username,
                email: options.email,
                password: hashedPassword,
                created_at: new Date(),
                updated_at: new Date()
            }).returning("*")
            // await em.persistAndFlush(user)
            user = result[0]
        } catch(error){
            if (error.code === '23505' || error.detail.includes("already exists.")){
                return {
                    errors: [
                        {
                            field: 'username',
                            message: 'User with same username already exists'
                        }
                    ]
                }
            }
            console.error("message: ", error)
        }
        // store user id session
        // this will set a cookie on the user
        req.session.userId = user.id
        user = { id: user.id, username: user.username, password: user.password, createdAt: user.created_at, updatedAt: user.updated_at, email: user.email}
        return { user }
    }

    @Mutation(() => User, { nullable: true})
    async updateUser(
        @Arg("id") id: number,
        @Arg("username") username: string,
        @Arg("password") password: string,
        @Ctx() { em }: MyContext
    ): Promise<User | null>{
        const user = await em.findOne(User, { id })
        if (user){
            user.username = username
            user.password = password
            await em.persistAndFlush(user)
            return user

        }

        return null
    }

    @Mutation(() => Boolean)
    async deleteUser(
        @Arg("id") id: number,
        @Ctx() { em }: MyContext
    ): Promise<boolean>{
        await em.nativeDelete(User, { id })
        return true
    }

    @Mutation(() => UserResponse)
    async login(
        @Arg("usernameOrEmail") usernameOrEmail: string,
        @Arg("password") password: string,
        @Ctx() { em, req }: MyContext
    ):Promise<UserResponse>{
        const user = await em.findOne(User, usernameOrEmail.includes('@') ? { email: usernameOrEmail } : { username: usernameOrEmail})
        if (user){
            const valid = await argon2.verify(user.password, password)
            if (valid) {
                req.session.userId = user.id
                return { user }
            } else {
                return {
                    errors: [
                        {
                            field: "password",
                            message: "that password does not match"
                        }
                    ]
                }

            }
        }
        return {
            errors: [
                {
                    field: "usernameOrEmail",
                    message: "that username doesn't exit"
                }
            ]
        }
    }

    @Mutation(() => Boolean)
    logout(
        @Ctx() { req, res }: MyContext
    ){
        return new Promise((resolve) => req.session.destroy(
            err => {
                res.clearCookie(COOKIE_NAME)
                console.error(err)
                if (err){
                    resolve(false)
                    return
                }
                resolve(true)
            }
        ))
    }

    @Query(() => [User])
    users(@Ctx(){ em }: MyContext ): Promise<User[]>{
        return em.find(User, {})
    }

    @Query(() => User, { nullable: true})
    user(
        @Arg('id', () => Int) id: number,
        @Ctx() { em }: MyContext
    ): Promise<User | null>{
        return em.findOne(User, { id });
    }

    @Mutation(() => Boolean)
    async forgetPassword(
        @Arg('email') email: string,
        @Ctx() {em, redis }: MyContext
    ){
        const user = await em.findOne(User, { email } )

        if (!user){
            // the email is not in the db
            return true
        }

        const token = v4()

        await redis.set(FORGET_PASSWORD_PREFIX + token, user.id, 'ex', 1000 * 60 * 60 * 24 * 3) // 3 days

        sendEmail(email, `<a href="http://localhost:3000/change-password/${token}">reset password</a>`)

        return true
    }

    @Mutation(() => UserResponse)
    async changePassword(
        @Arg('newPassword') newPassword: string,
        @Arg('token') token: string,
        @Ctx() { em, redis, req }: MyContext
    ): Promise<UserResponse>{
        if (newPassword.length <= 3) {
            return {
                errors: [
                    {
                        field: "newPassword",
                        message: "password must be greater than 3",
                    }
                ]
            }
        }

        const userId = await redis.get(FORGET_PASSWORD_PREFIX + token)
        if (!userId){
            return {
                errors: [
                    {
                        field: "token",
                        message: "token has expired",
                    }
                ]
            }
        }

        const user = await em.findOne(User, { id: parseInt(userId) } )
        if (!user){
            return {
                errors: [
                    {
                        field: "token",
                        message: "user no longer exits",
                    }
                ]
            }
        }

        const hashedPassword = await argon2.hash(newPassword)
        user.password = hashedPassword
        await em.persistAndFlush(user)
        req.session.userId = user.id
        await redis.del(FORGET_PASSWORD_PREFIX + token)
        return { user }
    }
}