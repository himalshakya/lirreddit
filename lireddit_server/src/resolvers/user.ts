import { User } from "../entities/User";
import { MyContext } from "src/types";
import { Arg, Ctx, Field, InputType, Int, Mutation, ObjectType, Query, Resolver } from "type-graphql";
import argon2  from "argon2";
import { EntityManager } from "@mikro-orm/postgresql"
import { COOKIE_NAME } from "../constants";

@InputType()
class UsernamePasswordInput {
    @Field()
    username: string
    @Field()
    password: string
}

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
        if (options.username.length <= 2){
            return {
                errors: [
                    {
                        field: 'username',
                        message: 'username must be greater than 2'
                    }
                ]
            }
        }
        if (options.password.length <= 3){
            return {
                errors: [
                    {
                        field: 'password',
                        message: 'password must be greater than 3'
                    }
                ]
            }
        }
        const hashedPassword = await argon2.hash(options.password)
        // const user = em.create(User, { username: options.username, password: hashedPassword })
        let user;
        try{
            const result = await (em as EntityManager).createQueryBuilder(User).getKnexQuery().insert({
                username: options.username,
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
        user = { id: user.id, username: user.username, password: user.password, createdAt: user.created_at, updatedAt: user.updated_at}
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
        @Arg("options") options: UsernamePasswordInput,
        @Ctx() { em, req }: MyContext
    ):Promise<UserResponse>{
        const user = await em.findOne(User, {username: options.username})
        if (user){
            const valid = await argon2.verify(user.password, options.password)
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
                    field: "username",
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
}