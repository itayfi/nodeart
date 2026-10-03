import {
  FcEditImage,
  FcPicture,
  FcLandscape,
  FcCalculator,
  FcFlowChart,
  FcElectricalSensor,
} from "react-icons/fc"
import { cn } from "cn"
import type { IconType } from "react-icons"
import type { Category } from "../engine"
const icons: Record<
  Category | "GLSL" | "p5.js" | "Previous frame" | "Image",
  IconType
> = {
  Inputs: FcElectricalSensor,
  Fields: FcLandscape,
  Math: FcCalculator,
  Color: FcEditImage,
  Generators: FcFlowChart,
  Output: FcPicture,
  GLSL: FcLandscape,
  "p5.js": FcEditImage,
  "Previous frame": FcFlowChart,
  Image: FcPicture,
}
export type CategoryIconName = keyof typeof icons
export function CategoryIcon({
  name,
  className,
}: {
  name: CategoryIconName
  className?: string
}) {
  const Icon = icons[name]
  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      className={cn("size-5 shrink-0", className)}
    />
  )
}
