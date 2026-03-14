import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  searchData: {
    certificateId: "",
    recipientName: "",
    recipientId: "",
  },
  result: null,
};

const certificateSlice = createSlice({
  name: "certificate",
  initialState,
  reducers: {
    setSearchData: (state, action) => {
      state.searchData = action.payload;
    },

    setCertificateResult: (state, action) => {
      state.result = action.payload;
    },

    clearCertificateResult: (state) => {
      state.result = null;
    },
  },
});

export const {
  setSearchData,
  setCertificateResult,
  clearCertificateResult,
} = certificateSlice.actions;

export default certificateSlice.reducer;