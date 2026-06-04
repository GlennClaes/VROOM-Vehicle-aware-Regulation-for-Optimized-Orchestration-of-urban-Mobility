<template>
<!--  <div class="modal-backdrop">-->
<!--    <div class="modal-card">-->
<!--      <div class="p-4">-->
<!--        <h5 class="fw-bold">Run Opslaan</h5>-->
<!--        <p class="text-muted small">Geef deze simulatie een naam voor je archief.</p>-->

<!--        <input-->
<!--          type="text"-->
<!--          class="form-control mb-3"-->
<!--          :value="runName"-->
<!--          @input="$emit('update:runName', $event.target.value)"-->
<!--          placeholder="bijv. Test Spitsuur Maandag"-->
<!--        >-->

<!--        <div class="d-flex gap-2 mt-4">-->
<!--          <button @click="$emit('discard')" class="btn btn-light border flex-grow-1">Verwijderen</button>-->
<!--          <button @click="$emit('save')" class="btn btn-primary flex-grow-1">Opslaan</button>-->
<!--        </div>-->
<!--      </div>-->
<!--    </div>-->
<!--  </div>-->
</template>

<script>
// export default { props: ['runName', 'runData'] }
</script>

<style scoped>
.modal-backdrop {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; z-index: 2000;
}
.modal-card {
  background: white; width: 400px; border-radius: 16px; shadow: 0 10px 25px rgba(0,0,0,0.1);
}
</style>
