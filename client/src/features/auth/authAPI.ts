import { apiClient } from "@/app/api-client";
import {
  ForgotPasswordPayloadType,
  LoginPayloadType,
  LoginResponseType,
  MagicLinkVerifyPayloadType,
  RegisterPayloadType,
  RegisterResponseType,
  ResendOtpPayloadType,
  ResetPasswordPayloadType,
  VerifyOtpPayloadType,
} from "./authType";

export const authApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    register: builder.mutation<RegisterResponseType, RegisterPayloadType>({
      query: (credentials) => ({
        url: "/auth/register",
        method: "POST",
        body: credentials,
      }),
    }),
    verifyOtp: builder.mutation<LoginResponseType, VerifyOtpPayloadType>({
      query: (body) => ({
        url: "/auth/verify-email",
        method: "POST",
        body,
      }),
    }),
    resendOtp: builder.mutation<
      { message: string; email: string; sent: boolean },
      ResendOtpPayloadType
    >({
      query: (body) => ({
        url: "/auth/resend-verification",
        method: "POST",
        body,
      }),
    }),
    forgotPassword: builder.mutation<
      { message: string; sent: boolean },
      ForgotPasswordPayloadType
    >({
      query: (body) => ({
        url: "/auth/forgot-password",
        method: "POST",
        body,
      }),
    }),
    resetPassword: builder.mutation<
      { message: string; reset: boolean },
      ResetPasswordPayloadType
    >({
      query: (body) => ({
        url: "/auth/reset-password",
        method: "POST",
        body,
      }),
    }),
    verifyMagicLink: builder.mutation<
      LoginResponseType,
      MagicLinkVerifyPayloadType
    >({
      query: (body) => ({
        url: "/auth/magic-link/verify",
        method: "POST",
        body,
      }),
    }),
    login: builder.mutation<LoginResponseType, LoginPayloadType>({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useVerifyOtpMutation,
  useResendOtpMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useVerifyMagicLinkMutation,
} = authApi;
