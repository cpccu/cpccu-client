'use client';
import Swal from 'sweetalert2';
export const showSuccessAlert = (title, text) => {
    return Swal.fire({
        icon: 'success',
        title,
        text,
        confirmButtonColor: 'oklch(0.45 0.18 260)',
        timer: 2000,
        timerProgressBar: true,
    });
};
export const showErrorAlert = (title, text) => {
    return Swal.fire({
        icon: 'error',
        title,
        text,
        confirmButtonColor: 'oklch(0.45 0.18 260)',
    });
};
export const showDeleteConfirm = (itemName) => {
    return Swal.fire({
        title: 'Are you sure?',
        text: `You are about to delete "${itemName}". This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'oklch(0.55 0.22 25)',
        cancelButtonColor: 'oklch(0.50 0.02 250)',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel',
        allowOutsideClick: false,
        customClass: {
            container: 'z-[9999]',
        },
    });
};
export const showInfoAlert = (title, text) => {
    return Swal.fire({
        icon: 'info',
        title,
        text,
        confirmButtonColor: 'oklch(0.45 0.18 260)',
    });
};
export const showConfirmAlert = (title, text) => {
    return Swal.fire({
        title,
        text,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: 'oklch(0.45 0.18 260)',
        cancelButtonColor: 'oklch(0.50 0.02 250)',
        confirmButtonText: 'Yes',
        cancelButtonText: 'Cancel',
    });
};
