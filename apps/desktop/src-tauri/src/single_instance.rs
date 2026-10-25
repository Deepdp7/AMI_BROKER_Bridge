//! One DataBridge per user: a second launch brings the running window forward instead of
//! starting another app and engine. A copy that is still closing answers "quitting", and the
//! new one waits for it, so reopening right after closing works.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::{Duration, Instant};

/// Loopback port used only to detect a second copy of the app and bring the first one forward.
const SINGLE_INSTANCE_PORT: u16 = 7892;
const SINGLE_INSTANCE_HELLO: &[u8] = b"DATABRIDGE\n";
/// Answer of an instance that is closing: the new one waits for it instead of giving up.
const SINGLE_INSTANCE_QUITTING: &[u8] = b"DATABRIDGE-QUIT\n";

enum InstanceReply {
    Running,
    Quitting,
    NotOurs,
}

fn ask_running_instance() -> InstanceReply {
    let Ok(mut s) = TcpStream::connect_timeout(&([127, 0, 0, 1], SINGLE_INSTANCE_PORT).into(), Duration::from_millis(500)) else {
        return InstanceReply::NotOurs;
    };
    let _ = s.set_read_timeout(Some(Duration::from_millis(1000)));
    let mut buf = [0u8; 32];
    match s.read(&mut buf) {
        Ok(n) if buf[..n].starts_with(SINGLE_INSTANCE_QUITTING) => InstanceReply::Quitting,
        Ok(n) if buf[..n].starts_with(SINGLE_INSTANCE_HELLO) => InstanceReply::Running,
        _ => InstanceReply::NotOurs,
    }
}

/// Returns the lock listener if we are the first instance, or None if another
/// DataBridge instance answered (it has been asked to show its window).
/// An instance that is still closing is waited for, so reopening right after closing works.
pub(crate) fn acquire() -> Option<Option<TcpListener>> {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        match TcpListener::bind(("127.0.0.1", SINGLE_INSTANCE_PORT)) {
            Ok(listener) => return Some(Some(listener)),
            Err(_) => match ask_running_instance() {
                InstanceReply::Running => return None,
                InstanceReply::Quitting if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(150)),
                _ => return Some(None), // not ours — run without the guard
            },
        }
    }
}

/// Answers later launches: "running" (and shows our window), or "quitting" once we are closing.
pub(crate) fn serve(listener: TcpListener, quitting: impl Fn() -> bool + Send + 'static, show: impl Fn() + Send + 'static) {
    std::thread::spawn(move || {
        for mut stream in listener.incoming().flatten() {
            if quitting() {
                let _ = stream.write_all(SINGLE_INSTANCE_QUITTING);
                continue;
            }
            let _ = stream.write_all(SINGLE_INSTANCE_HELLO);
            show();
        }
    });
}
