import { createSlice } from "@reduxjs/toolkit";

const memberSlice = createSlice({
  name: "members",
  initialState: { list: [], loading: false, error: null },
    reducers: {
    setMembers: (state, action) => {
      state.list = action.payload;
      state.loading = false;
      state.error = null;
    },
    addMember: (state, action) => {
      state.list.push(action.payload);
        state.loading = false;
        state.error = null;
    },
    updateMember: (state, action) => {
      const index = state.list.findIndex(member => member.id === action.payload.id);
        if (index !== -1) {
            state.list[index] = action.payload;
            state.loading = false;
            state.error = null;
        }
    },
    deleteMember: (state, action) => {
      state.list = state.list.filter(member => member.id !== action.payload);
        state.loading = false;
        state.error = null;
    },
  },
});

export const { setMembers, addMember, updateMember, deleteMember } = memberSlice.actions;
export default memberSlice.reducer;