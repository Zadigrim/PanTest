# NOTE: create-expo-module --local template podspec. If an EAS iOS build
# (or pod install) fails on this module, scaffold a throwaway module with
# `npx create-expo-module@latest --local` on the SAME Expo SDK and diff
# its podspec — the ExpoModulesCore wiring is SDK-version-sensitive.
# See README.md.
Pod::Spec.new do |s|
  s.name           = 'OkujiTouch'
  s.version        = '0.1.0'
  s.summary        = 'okuji contact-geometry touch observer'
  s.description    = 'Non-intrusive contact-ellipse reader for the stamp tilt mechanic (Android-only signal; iOS no-op).'
  s.author         = ''
  s.homepage       = 'https://okuji.app'
  s.platforms      = { :ios => '15.1', :tvos => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
