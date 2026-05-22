"use client";

import { useEffect, useState } from "react";
import {
  useCreateAdminContentMutation,
  useDeleteAdminContentMutation,
  useGetAdminContentQuery,
  useUpdateAdminContentMutation,
} from "@/features/admin/adminApi";

const normalizeItem = (item) => ({
  ...item,
  id: item.id || item._id,
});

export default function useAdminContent(resource, fallback) {
  const [items, setItems] = useState(fallback);
  const { data, error, isLoading } = useGetAdminContentQuery(resource);
  const [createContent] = useCreateAdminContentMutation();
  const [updateContent] = useUpdateAdminContentMutation();
  const [deleteContent] = useDeleteAdminContentMutation();

  useEffect(() => {
    if (data?.data) {
      setItems(data.data.map(normalizeItem));
    }
  }, [data]);

  const createItem = async (body) => {
    const result = await createContent({ resource, body }).unwrap();
    const item = normalizeItem(result.data);
    setItems((current) => [item, ...current]);
    return item;
  };

  const updateItem = async (id, body) => {
    const result = await updateContent({ resource, id, body }).unwrap();
    const item = normalizeItem(result.data);
    setItems((current) =>
      current.map((entry) => (entry.id === id ? item : entry))
    );
    return item;
  };

  const deleteItem = async (id) => {
    await deleteContent({ resource, id }).unwrap();
    setItems((current) => current.filter((entry) => entry.id !== id));
  };

  return {
    createItem,
    deleteItem,
    error,
    isLoading,
    items,
    setItems,
    updateItem,
  };
}
