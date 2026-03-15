import Swal from 'sweetalert2'

export default function ErrorAlert({title, text, footer}) {
  Swal.fire({
  icon: "error",
  title: title || "Oops...",
  text: text || "Something went wrong!",
  footer: footer || '<a href="#">Why do I have this issue?</a>'
});
}
