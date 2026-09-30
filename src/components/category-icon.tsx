import { FcEditImage, FcPicture, FcTemplate } from 'react-icons/fc'
import { cn } from 'cn'

const icons = { material: FcEditImage, output: FcPicture, collection: FcTemplate }
export type CategoryIconName = keyof typeof icons

/** Colored category markers; use Lucide for actions and control indicators. */
export function CategoryIcon({ name, className }: { name: CategoryIconName; className?: string }) {
  const Icon = icons[name]
  return <Icon aria-hidden="true" focusable="false" className={cn('size-5 shrink-0', className)} />
}
