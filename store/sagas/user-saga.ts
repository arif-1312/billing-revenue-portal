import { put, takeLatest } from "redux-saga/effects";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { AppUser } from "@/types/auth";
import { USER_LOGIN_REQUEST, USER_LOGOUT_REQUEST } from "../actions/user-actions";
import { clearUser, setUser } from "../reducers/user-reducer";

function* handleUserLogin(action: PayloadAction<AppUser>) {
    yield put(setUser(action.payload));
}

function* handleUserLogout() {
    yield put(clearUser());
}

export function* watchUserAuth(): Generator {
    yield takeLatest(USER_LOGIN_REQUEST, handleUserLogin);
    yield takeLatest(USER_LOGOUT_REQUEST, handleUserLogout);
}
