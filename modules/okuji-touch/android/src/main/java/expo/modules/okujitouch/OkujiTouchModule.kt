package expo.modules.okujitouch

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OkujiTouchModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OkujiTouch")

    View(OkujiTouchView::class) {
      Events("onTouchGeometry")
    }
  }
}
