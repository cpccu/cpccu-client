import Swal from 'sweetalert2'

function SuccessAlert({ title }) {
  Swal.fire({
    position: "center",
    icon: "success",
    title: title,
    showConfirmButton: true,
  });
}

export default SuccessAlert
