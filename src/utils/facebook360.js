/**
 * Export une image panoramique équirectangulaire avec métadonnées XMP
 * pour que Facebook la reconnaisse comme photo 360°
 */
export const exportFor360Facebook = async (imageUrl, filename = 'panorama-360') => {
  try {
    // Télécharger l'image
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    
    // Créer un canvas pour manipuler l'image
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = URL.createObjectURL(blob)
    })

    const canvas = document.createElement('canvas')
    canvas.width  = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)

    // Convertir en blob JPEG avec métadonnées XMP
    // Les métadonnées XMP indiquent à Facebook que c'est une photo équirectangulaire 360°
    canvas.toBlob(async (jpegBlob) => {
      // Injecter les métadonnées XMP dans le JPEG
      const xmpData = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:GPano="http://ns.google.com/photos/1.0/panorama/">
      <GPano:ProjectionType>equirectangular</GPano:ProjectionType>
      <GPano:UsePanoramaViewer>True</GPano:UsePanoramaViewer>
      <GPano:CroppedAreaImageWidthPixels>${img.width}</GPano:CroppedAreaImageWidthPixels>
      <GPano:CroppedAreaImageHeightPixels>${img.height}</GPano:CroppedAreaImageHeightPixels>
      <GPano:FullPanoWidthPixels>${img.width}</GPano:FullPanoWidthPixels>
      <GPano:FullPanoHeightPixels>${img.height}</GPano:FullPanoHeightPixels>
      <GPano:CroppedAreaLeftPixels>0</GPano:CroppedAreaLeftPixels>
      <GPano:CroppedAreaTopPixels>0</GPano:CroppedAreaTopPixels>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`

      const xmpBytes = new TextEncoder().encode(xmpData)
      const marker   = new Uint8Array([0xFF, 0xE1]) // APP1 marker
      const length   = new DataView(new ArrayBuffer(2))
      length.setUint16(0, xmpBytes.length + 2 + 29) // 29 = "http://ns.adobe.com/xap/1.0/\0"
      const nsBytes  = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0')

      // Lire le blob JPEG original
      const originalBytes = new Uint8Array(await jpegBlob.arrayBuffer())

      // Construire le nouveau JPEG avec XMP injecté après SOI (FF D8)
      const soi    = originalBytes.slice(0, 2)  // FF D8
      const rest   = originalBytes.slice(2)

      const newJpeg = new Uint8Array(
        soi.length + marker.length + 2 + nsBytes.length + xmpBytes.length + rest.length
      )

      let offset = 0
      newJpeg.set(soi,    offset); offset += soi.length
      newJpeg.set(marker, offset); offset += marker.length
      newJpeg.set(new Uint8Array(length.buffer), offset); offset += 2
      newJpeg.set(nsBytes,  offset); offset += nsBytes.length
      newJpeg.set(xmpBytes, offset); offset += xmpBytes.length
      newJpeg.set(rest,     offset)

      // Télécharger le fichier
      const finalBlob = new Blob([newJpeg], { type: 'image/jpeg' })
      const url = URL.createObjectURL(finalBlob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `${filename}-facebook360.jpg`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/jpeg', 0.92)

  } catch(e) {
    console.error('Export Facebook 360 failed:', e)
    // Fallback : téléchargement direct sans XMP
    const a   = document.createElement('a')
    a.href     = imageUrl
    a.download = `${filename}-360.jpg`
    a.target   = '_blank'
    a.click()
  }
}
