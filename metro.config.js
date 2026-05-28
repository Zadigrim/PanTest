// Metro config wrapped with Sentry's serializer so source maps are emitted in
// the format the Sentry CLI expects, and the @sentry/react-native/expo plugin
// can upload them automatically during `eas build` when SENTRY_AUTH_TOKEN is
// set in the build environment.
// See: https://docs.sentry.io/platforms/react-native/manual-setup/expo/
const { getSentryExpoConfig } = require('@sentry/react-native/metro')

const config = getSentryExpoConfig(__dirname)

module.exports = config
