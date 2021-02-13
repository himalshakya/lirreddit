import { User } from "../entities/User";
import { MyContext } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import argon2 from "argon2";
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "../constants";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { validateRegister } from "../utils/validateRegister";
import { sendEmail } from "../utils/sendEmails";
import { v4 } from "uuid";
import { getConnection } from "typeorm";

@ObjectType()
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver(User)
export class UserResolver {
  @FieldResolver(() => String)
  email(@Root() user: User, @Ctx() { req }: MyContext){
    // ok to show their own email
    if (req.session.userId === user.id){
      return user.email
    }

    // current user wants to see someone elses email
    return ""
  }


  @Query(() => User, { nullable: true })
  async me(@Ctx() { req }: MyContext) {
    if (!req.session.userId) {
      return null;
    }
    return await User.findOne({ id: req.session.userId });
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const errors = validateRegister(options);
    if (errors) {
      return { errors };
    }

    const hashedPassword = await argon2.hash(options.password);
    let user;
    try {
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(User)
        .values(
          {
            username: options.username,
            email: options.email,
            password: hashedPassword,
          },
        )
        .returning("*")
        .execute();

        user = result.raw[0]
    } catch (error) {
      if (error.code === "23505" || error.detail.includes("already exists.")) {
        return {
          errors: [
            {
              field: "username",
              message: "User with same username already exists",
            },
          ],
        };
      }
      console.error("message: ", error);
    }

    // store user id session
    // this will set a cookie on the user
    req.session.userId = user.id;
    return { user };
  }

  @Mutation(() => User, { nullable: true })
  async updateUser(
    @Arg("id") id: number,
    @Arg("username") username: string,
    @Arg("password") password: string
  ): Promise<User | null> {
    const user = await User.findOne(id);
    if (user) {
      user.username = username;
      user.password = password;
      await User.update({id}, user)
      return user;
    }

    return null;
  }

  @Mutation(() => Boolean)
  async deleteUser(
    @Arg("id") id: number
  ): Promise<boolean> {
    await User.delete(id)
    return true;
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const user = await User.findOne({ where: [{ username: usernameOrEmail}, { email: usernameOrEmail}]})
    if (user) {
      const valid = await argon2.verify(user.password, password);
      if (valid) {
        req.session.userId = user.id;
        return { user };
      } else {
        return {
          errors: [
            {
              field: "password",
              message: "that password does not match",
            },
          ],
        };
      }
    }
    return {
      errors: [
        {
          field: "usernameOrEmail",
          message: "that username doesn't exit",
        },
      ],
    };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME);
        console.error(err);
        if (err) {
          resolve(false);
          return;
        }
        resolve(true);
      })
    );
  }

  @Query(() => [User])
  users(): Promise<User[]> {
    return User.find();
  }

  @Query(() => User, { nullable: true })
  user(@Arg("id", () => Int) id: number): Promise<User | undefined> {
    return User.findOne(id);
  }

  @Mutation(() => Boolean)
  async forgetPassword(
    @Arg("email") email: string,
    @Ctx() { redis }: MyContext
  ) {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      // the email is not in the db
      return true;
    }

    const token = v4();

    await redis.set(
      FORGET_PASSWORD_PREFIX + token,
      user.id,
      "ex",
      1000 * 60 * 60 * 24 * 3
    ); // 3 days

    sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${token}">reset password</a>`
    );

    return true;
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("newPassword") newPassword: string,
    @Arg("token") token: string,
    @Ctx() { redis, req }: MyContext
  ): Promise<UserResponse> {
    console.log("token", token)
    if (newPassword.length <= 3) {
      return {
        errors: [
          {
            field: "newPassword",
            message: "password must be greater than 3",
          },
        ],
      };
    }

    const userIdStr = await redis.get(FORGET_PASSWORD_PREFIX + token);
    if (!userIdStr) {
      return {
        errors: [
          {
            field: "token",
            message: "token has expired",
          },
        ],
      };
    }

    const userId = parseInt(userIdStr);
    const user = await User.findOne(userId);
    if (!user) {
      return {
        errors: [
          {
            field: "token",
            message: "user no longer exits",
          },
        ],
      };
    }

    const hashedPassword = await argon2.hash(newPassword);
    await User.update({ id: userId }, { password: hashedPassword });
    req.session.userId = user.id;
    await redis.del(FORGET_PASSWORD_PREFIX + token);
    return { user };
  }
}
