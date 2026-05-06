/* ══════════════════════════════════════════════════════════════
   BATTLE.JS — Battle Records tab
   Live multiplayer battle tracker for KAP 6e battles.
══════════════════════════════════════════════════════════════ */

const TabBattle = {

  render() {
    const panel = document.getElementById('tab-battle');
    if (!panel) return;

    if (isGM()) {
      panel.innerHTML = `
        <div class="battle-empty">
          <div class="battle-empty-icon">⚔</div>
          <h2 class="battle-empty-title">No Battle in Progress</h2>
          <p class="battle-empty-text">When you're ready to lead the conroi into battle, begin here.</p>
          <button class="btn btn-primary battle-start-btn" onclick="TabBattle.startSetup()">Start Battle</button>
        </div>`;
    } else {
      panel.innerHTML = `
        <div class="battle-empty">
          <div class="battle-empty-icon">⚔</div>
          <h2 class="battle-empty-title">No Battle in Progress</h2>
          <p class="battle-empty-text">The field is quiet. When the GM calls the conroi to arms, the battle will appear here.</p>
        </div>`;
    }
  },

  startSetup() {
    Components.toast('Battle setup coming soon', 'info');
  }
};
