extern crate reqwest;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub async fn fetch_url(url: String) -> Result<JsValue, JsValue> {
    let response = reqwest::get(&url).await.unwrap();
    let body = response.text().await.unwrap();
    Ok(JsValue::from_str(&body))
}
