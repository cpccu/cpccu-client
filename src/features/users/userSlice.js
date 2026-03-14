import { createSlice } from "@reduxjs/toolkit";

const userSlice = createSlice({
  name: "users",
  initialState: { list: [], loading: false, error: null },
    reducers: {
    setUsers: (state, action) => {
      state.list = action.payload;
      state.loading = false;
      state.error = null;
    },
    addUser: (state, action) => {
      state.list.push(action.payload);
        state.loading = false;
        state.error = null;
    },
    updateUser: (state, action) => {
      const index = state.list.findIndex(user => user.id === action.payload.id);
        if (index !== -1) {
            state.list[index] = action.payload;
            state.loading = false;
            state.error = null;
        }
    },
    deleteUser: (state, action) => {
      state.list = state.list.filter(user => user.id !== action.payload);
        state.loading = false;
        state.error = null;
    },
  },
});

export const { setUsers, addUser, updateUser, deleteUser } = userSlice.actions;
export default userSlice.reducer;

