import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { getMe, logoutUser as logoutUserApi } from "@/lib/api/auth";

export interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
}

const initialState: AuthState = {
  user: null,
  isLoading: true,
};

export const checkAuth = createAsyncThunk(
  "auth/checkAuth",
  async (_, { rejectWithValue }) => {
    try {
      const data = await getMe();
      if (data && data.user) {
        if (typeof window !== "undefined") {
          localStorage.setItem("pdf_user", JSON.stringify(data.user));
        }
        return data.user as User;
      }
      if (typeof window !== "undefined") {
        localStorage.removeItem("pdf_user");
        localStorage.removeItem("pdf_session_token");
      }
      return rejectWithValue("Unauthorized");
    } catch {
      if (typeof window !== "undefined") {
        localStorage.removeItem("pdf_user");
        localStorage.removeItem("pdf_session_token");
      }
      return rejectWithValue("Unauthorized");
    }
  }
);

export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { rejectWithValue }) => {
    try {
      await logoutUserApi();
      if (typeof window !== "undefined") {
        localStorage.removeItem("pdf_user");
        localStorage.removeItem("pdf_session_token");
      }
    } catch {
      if (typeof window !== "undefined") {
        localStorage.removeItem("pdf_user");
        localStorage.removeItem("pdf_session_token");
      }
      return rejectWithValue("Logout failed");
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isLoading = false;
      if (typeof window !== "undefined" && action.payload) {
        localStorage.setItem("pdf_user", JSON.stringify(action.payload));
      }
    },
    logout: (state) => {
      state.user = null;
      state.isLoading = false;
      if (typeof window !== "undefined") {
        localStorage.removeItem("pdf_user");
        localStorage.removeItem("pdf_session_token");
      }
    },
    hydrateFromStorage: (state) => {
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("pdf_user");
          if (raw) {
            state.user = JSON.parse(raw);
            state.isLoading = false;
          }
        } catch {
          // ignore
        }
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkAuth.pending, (state) => {
        if (!state.user) {
          state.isLoading = true;
        }
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isLoading = false;
        state.user = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.isLoading = false;
      })
      .addCase(logoutUser.rejected, (state) => {
        state.user = null;
        state.isLoading = false;
      });
  },
});

export const { login, logout, setLoading, hydrateFromStorage } = authSlice.actions;
export default authSlice.reducer;
