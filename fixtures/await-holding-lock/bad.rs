use std::{future::Future, sync::Mutex};

pub async fn snapshot_and_deliver(
    state: &Mutex<u64>,
    delivery: impl Future<Output = ()>,
) -> Result<u64, &'static str> {
    let guard = state.lock().map_err(|_| "state lock poisoned")?;
    let snapshot = *guard;
    delivery.await;
    drop(guard);
    Ok(snapshot)
}
