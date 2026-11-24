import type { AppUser } from "@/types/auth";

export const USER_LOGIN_REQUEST: string = "user/USER_LOGIN_REQUEST" as const;
export const USER_LOGOUT_REQUEST : string = "user/USER_LOGOUT_REQUEST" as const;


export const userLoginRequest = (payload: AppUser) => ({
    type: USER_LOGIN_REQUEST,
    payload,
});

export const userLogoutRequest = () => ({
    type: USER_LOGOUT_REQUEST,
});
