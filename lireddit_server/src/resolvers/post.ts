import { Post } from "../entities/Post";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { MyContext } from "src/types";
import { isAuth } from "..//middleware/isAuth";
import { getConnection } from "typeorm";
import { Updoot } from "../entities/Updoot";
import { User } from "../entities/User";

@InputType()
class PostInput {
  @Field()
  title: string;

  @Field()
  text: string;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];
  @Field()
  hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(
    @Root() root: Post) {
    return root.text.slice(0, 50);
  }

  @FieldResolver(() => User)
  creator(
    @Root() post: Post,
    @Ctx() { userLoader } : MyContext
    ) {
    return userLoader.load(post.creatorId);
  }

  @FieldResolver(() => Int, {nullable: true})
  async voteStatus(
    @Root() post: Post,
    @Ctx() { req, updootLoader } : MyContext
  ){
    // const updoot = await updootLoader.load({postId: post.id, userId: post.creatorId})

    if (!req.session.userId){
      return null
    }
    const updoot = await updootLoader.load({postId: post.id, userId: req.session.userId})

    return updoot ? updoot.value : null

  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg("postId", () => Int) postId: number,
    @Arg("value", () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const { userId } = req.session;
    const updoot = await Updoot.findOne({ where: { postId, userId } });
    const isUpdoot = value !== -1;
    const realValue = isUpdoot ? 1 : -1;

    // the user has voted on the post before
    if (updoot && updoot.value !== realValue) {
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `UPDATE updoot SET value = $3 WHERE "userId" = $1 AND "postId" = $2`,
          [userId, postId, realValue]
        );
        await tm.query(`UPDATE post SET points = points + $2 WHERE id = $1`, [
          postId,
          2 * realValue,
        ]);
      });
    } else if (!updoot) {
      // has never voted before
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `INSERT INTO updoot("userId", "postId", "value") VALUES ($1, $2, $3)`,
          [userId, postId, realValue]
        );
        await tm.query(`UPDATE post SET points = points + $2 WHERE id = $1`, [
          postId,
          realValue,
        ]);
      });
    }

    // await Updoot.insert({
    //   userId,
    //   postId,
    //   value: realValue,
    // });
    /*
    await getConnection().query(
      `
      START TRANSACTION;
      INSERT INTO updoot("userId", "postId", "value") VALUES (${userId}, ${postId}, ${realValue});
      UPDATE post SET points = points + ${realValue} WHERE id = ${postId};
      COMMIT;
    `
    );
      */
    return true;
  }

  @Query(() => PaginatedPosts)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit);
    const realLimitPlusOne = realLimit + 1;
    // const realLimit = 10

    const replacements: any[] = [realLimitPlusOne];

    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
    }

    const posts = await getConnection().query(
      `
        SELECT p.*
        FROM post p
        ${cursor ? `WHERE p."createdAt" < $2` : ""}
        ORDER BY p."createdAt" DESC
        LIMIT $1
      `,
      replacements
    );

    // const qb = getConnection()
    //   .getRepository(Post)
    //   .createQueryBuilder("p")
    //   .innerJoinAndSelect("p.creator", "u", 'u.id = p."creatorId"')
    //   .orderBy('p."createdAt"', "DESC")
    //   .take(realLimitPlusOne)
    // .where("user.id = :id", { id: 1 })
    // .getOne();
    // return Post.find();

    // if (cursor){
    //   qb.where('p."createdAt" < :cursor', { cursor: new Date(parseInt(cursor)) })
    // }

    // const posts = await qb.getMany()

    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === realLimitPlusOne,
    };
  }

  @Query(() => Post, { nullable: true })
  post(@Arg("id", () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne(id);
  }

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg("input") post: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    return Post.create({ ...post, creatorId: req.session.userId }).save();
  }

  @Mutation(() => Post, { nullable: true })
  @UseMiddleware(isAuth)
  async updatePost(
    @Arg("id", () => Int) id: number,
    @Arg("title") title: string,
    @Arg("text") text: string,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    // const post = await Post.findOne({ where: { id } });
    // if (!post) {
    //   return null;
    // }

    // if (typeof title !== "undefined") {
    //   post.title = title;
    // return Post.update({ id, creatorId: req.session.userId }, { title, text });
    // }

    // return post;

    const resultPost = await getConnection()
      .createQueryBuilder()
      .update(Post)
      .set({ title, text })
      .where('id = :id and "creatorId"= :creatorId', {
        id,
        creatorId: req.session.userId,
      })
      .returning("*")
      .execute();

    return resultPost.raw[0];
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePost(
    @Arg("id", () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<boolean> {
    // not cascade way
    // const post  = await Post.findOne(id)
    // if (!post){
    //   return false
    // }
    // if (post.creatorId !== req.session.userId){
    //   throw new Error("not authorized")
    // }
    // await Updoot.delete({postId: id})
    // await Post.delete({ id });

    await Post.delete({ id, creatorId: req.session.userId });
    return true;
  }
}
