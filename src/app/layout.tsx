import './globals.css'

export const metadata = {
  title: 'Sermon Translation System',
  description: 'Real-time translation for sermons and presentations',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
