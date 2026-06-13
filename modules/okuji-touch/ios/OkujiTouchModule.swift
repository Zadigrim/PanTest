import ExpoModulesCore

public class OkujiTouchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OkujiTouch")

    View(OkujiTouchView.self) {
      Events("onTouchGeometry")
    }
  }
}
