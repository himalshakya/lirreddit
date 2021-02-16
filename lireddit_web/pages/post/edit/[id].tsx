import { Box, Button, Flex } from '@chakra-ui/react';
import { Form, Formik } from 'formik';
import { withUrqlClient } from 'next-urql';
import { useRouter } from 'next/router';
import React from 'react';
import { InputField } from '../../../components/InputField';
import { Layout } from '../../../components/Layout';
import { usePostQuery, useUpdatePostMutation } from '../../../generated/graphql';
import { createUrqlClient } from '../../../utils/createUrqlClient';
import { useGetIntId } from '../../../utils/useGetIntId';

const EditPost = ({}) => {
    const router = useRouter()
    const intId = useGetIntId()
    const [{ data, error, fetching }] = usePostQuery({
        pause: intId === -1,
        variables: {
        postId: intId,
        },
    });
    const [, updatePost] = useUpdatePostMutation()

    if (fetching) {
      return (
        <Layout>
          <div>Loading...</div>
        </Layout>
      );
    }

    if (error){
      return <div>{error.message}</div>
    }

    if(!data?.post){
      return <Layout><Box>Count not find post</Box></Layout>
    }

    return (
        <Layout variant="small">
          <Formik
            initialValues={{ title: data.post.title, text: data.post.text }}
            onSubmit={async (values) => {
              const {error} = await updatePost({ id: intId, ...values });
              if (!error){
                router.back();
              }
            }}
          >
            {({ isSubmitting }) => (
              <Form>
                <InputField name="title" placeholder="title" label="Title" />
                <Box mt={4}>
                  <InputField
                    name="text"
                    placeholder="text..."
                    label="Body"
                    textarea={true}
                  />
                </Box>
                <Flex>
                  <Button
                    mt={4}
                    type="submit"
                    isLoading={isSubmitting}
                    colorScheme="teal"
                    variant="solid"
                  >
                    Update Post
                  </Button>
                </Flex>
              </Form>
            )}
          </Formik>
        </Layout>
      );
}

export default withUrqlClient(createUrqlClient)(EditPost)