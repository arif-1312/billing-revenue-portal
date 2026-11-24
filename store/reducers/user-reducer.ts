import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { AppUser } from "@/types/auth";

interface UserState {
	user: AppUser | null;
	isAuthenticated: boolean;
}

const initialState: UserState = {
	user: null,
	isAuthenticated: false,
};

const userSlice = createSlice({
	name: "user",
	initialState,
	reducers: {
		setUser(state, action: PayloadAction<AppUser>) {
			state.user = action.payload;
			state.isAuthenticated = true;
		},
		clearUser(state) {
			state.user = null;
			state.isAuthenticated = false;
		},
	},
});

export const { setUser, clearUser } = userSlice.actions;
export default userSlice.reducer;
