import "@stdlib/deploy";

// ============================================================
// TON Staking Pool Contract — Tact Language
// Admin key model: hanya admin yang bisa trigger withdraw
// ============================================================

// Messages
message Stake {
  user_id: String;       // telegram user id (untuk log)
  stake_id: String;      // UUID stake dari database
}

message AdminWithdraw {
  to: Address;
  amount: Int as coins;
  stake_id: String;
}

message EmergencyWithdraw {
  to: Address;
}

// Events (untuk on-chain log)
message StakeReceived {
  from: Address;
  amount: Int as coins;
  stake_id: String;
  timestamp: Int as uint32;
}

message WithdrawProcessed {
  to: Address;
  amount: Int as coins;
  stake_id: String;
  timestamp: Int as uint32;
}

contract StakingPool with Deployable {

  admin: Address;
  total_staked: Int as coins;
  stake_count: Int as uint32;

  init(admin: Address) {
    self.admin = admin;
    self.total_staked = 0;
    self.stake_count = 0;
  }

  // ============================================================
  // USER: Deposit TON untuk stake
  // User kirim TON + message Stake
  // ============================================================
  receive(msg: Stake) {
    let ctx: Context = context();
    require(ctx.value > ton("0.05"), "Minimum stake is 0.05 TON");

    // Simpan jumlah TON yang di-stake (kurangi gas fee)
    let stake_amount: Int = ctx.value - ton("0.01"); // 0.01 untuk gas
    self.total_staked = self.total_staked + stake_amount;
    self.stake_count = self.stake_count + 1;

    // Emit event
    emit(StakeReceived{
      from: ctx.sender,
      amount: stake_amount,
      stake_id: msg.stake_id,
      timestamp: now()
    }.toCell());
  }

  // ============================================================
  // ADMIN: Proses withdraw — kirim TON ke wallet user
  // ============================================================
  receive(msg: AdminWithdraw) {
    let ctx: Context = context();
    require(ctx.sender == self.admin, "Only admin can withdraw");
    require(msg.amount > 0, "Amount must be positive");
    require(
      myBalance() - msg.amount > ton("0.1"),
      "Insufficient balance (keeping reserve)"
    );

    self.total_staked = self.total_staked - msg.amount;

    // Kirim TON ke wallet user
    send(SendParameters{
      to: msg.to,
      value: msg.amount,
      mode: SendIgnoreErrors,
      body: WithdrawProcessed{
        to: msg.to,
        amount: msg.amount,
        stake_id: msg.stake_id,
        timestamp: now()
      }.toCell()
    });
  }

  // ============================================================
  // ADMIN: Emergency withdraw semua saldo
  // ============================================================
  receive(msg: EmergencyWithdraw) {
    let ctx: Context = context();
    require(ctx.sender == self.admin, "Only admin");

    send(SendParameters{
      to: msg.to,
      value: 0,
      mode: SendRemainingBalance + SendIgnoreErrors
    });
    self.total_staked = 0;
  }

  // ============================================================
  // ADMIN: Ganti admin address
  // ============================================================
  receive("ChangeAdmin") {
    // TODO: implement 2-step admin transfer jika perlu
  }

  // ============================================================
  // GETTERS
  // ============================================================
  get fun getAdmin(): Address {
    return self.admin;
  }

  get fun getBalance(): Int {
    return myBalance();
  }

  get fun getTotalStaked(): Int {
    return self.total_staked;
  }

  get fun getStakeCount(): Int {
    return self.stake_count;
  }

  // Contract bisa terima TON plain (untuk top-up saldo)
  receive() {}
}
