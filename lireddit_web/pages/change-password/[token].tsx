import { NextPage } from "next";
// import React, { useState } from "react";
import { toErrorMap } from "../../utils/toErrorMap";
import { Wrapper } from "../../components/Wrapper";
import { InputField } from "../../components/InputField";
import { Formik, Form } from "formik";
import { Button } from "@chakra-ui/react";
import { useChangePasswordMutation } from "../../generated/graphql";
import { useRouter } from "next/router";
import { useToast } from "@chakra-ui/react";
import { withUrqlClient } from "next-urql";
import { createUrqlClient } from "../../utils/createUrqlClient";

const ChangePassword: NextPage<{ token: string }> = () => {
  const router = useRouter();
  const [, changePassword] = useChangePasswordMutation();
  const toast = useToast();

  return (
    <Wrapper variant="small">
      <Formik
        initialValues={{ newPassword: "" }}
        onSubmit={async (values, { setErrors }) => {
          const response = await changePassword({
            newPassword: values.newPassword,
            token: typeof router.query.token === 'string' ? router.query.token : "",
          });
          if (response.data?.changePassword.errors) {
            const errorMap = toErrorMap(response.data.changePassword.errors)
            if ('token' in errorMap){
              // setTokenError(errorMap.token)
              toast({
                title: "An error occurred.",
                description: errorMap.token,
                status: "error",
                duration: 9000,
                isClosable: true,
              })
            } else {
              setErrors(errorMap);
            }
          } else if (response.data?.changePassword.user) {
            // worked
            router.push("/");
          }
        }}
      >
        {({ isSubmitting }) => (
          <Form>
            <InputField
              name="newPassword"
              placeholder="new password"
              label="New Password"
              type="password"
            />
            <Button
              mt={4}
              type="submit"
              isLoading={isSubmitting}
              colorScheme="teal"
              variant="solid"
            >
              Change Password
            </Button>
          </Form>
        )}
      </Formik>
    </Wrapper>
  );
};

export default withUrqlClient(createUrqlClient)(ChangePassword);