export function accountRecoveryMessage(message?: string) {
  if (!message) return undefined;
  if (/limit[_\s-]*databases?_reads_exceeded|limit[_\s-]*database_reads_exceeded|Appwrite user store request failed with HTTP 402/i.test(message)) {
    return "ប្រព័ន្ធគណនីកំពុងមានចរាចរណ៍ខ្ពស់បន្តិច។ សូមព្យាយាមម្តងទៀតនៅពេលក្រោយ។";
  }
  return "មិនអាចរក្សាទុកព័ត៌មានគណនីបានទេ។ សូមព្យាយាមម្តងទៀត។";
}
