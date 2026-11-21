export const vDialogoModal = {
  mounted(dialogo) {
    dialogo.showModal()
  },
  beforeUnmount(dialogo) {
    if (dialogo.open) dialogo.close()
  },
}
