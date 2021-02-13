import { ChevronUpIcon, ChevronDownIcon } from "@chakra-ui/icons";
import { IconButton, VStack, Text } from "@chakra-ui/react";
import React, { useState } from "react";
import { PostSnippetFragment, useVoteMutation } from "../generated/graphql";

interface UpdootSectionProps {
  post: PostSnippetFragment;
}

export const UpdootSection: React.FC<UpdootSectionProps> = ({ post }) => {
  const [loadingState, setLoadingState] = useState<
    "updoot-loading" | "downdoot-loading" | "not-loading"
  >("not-loading");
  const [, vote] = useVoteMutation()
  return (
    <VStack
      spacing={4}
      align="stretch"
      justifyContent="center"
      alignItems="center"
      mr={4}
    >
      <IconButton
        aria-label="updoot post"
        onClick={async () => {
          if (post.voteStatus === 1){
            return
          }
          setLoadingState("updoot-loading");
          await vote({
            postId: post.id,
            value: 1,
          });
          setLoadingState("not-loading");
        }}
        icon={<ChevronUpIcon w={8} h={8} />}
        isLoading={loadingState === "updoot-loading"}
        colorScheme={post.voteStatus === 1 ? "teal" : undefined}
      ></IconButton>
      <Text color="red.500" fontSize="xl">
        {post.points}
      </Text>
      <IconButton
        aria-label="downdoot post"
        onClick={async () => {
          if (post.voteStatus === -1){
            return
          }
          setLoadingState("downdoot-loading");
          await vote({
            postId: post.id,
            value: -1,
          });
          setLoadingState("not-loading");
        }}
        icon={<ChevronDownIcon w={8} h={8} />}
        isLoading={loadingState === "downdoot-loading"}
        colorScheme={post.voteStatus === -1 ? "orange" : undefined}
      ></IconButton>
    </VStack>
  );
};
