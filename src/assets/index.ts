/**
 * Imagens do Figma. Enquanto um item estiver null/ausente, o app usa o visual atual (Ionicons / logo em texto).
 *
 * 1) Exporte do Figma em PNG @3x (ou @2x) com fundo transparente e coloque nesta pasta.
 * 2) Descomente/adicione a linha com require(...). A chave do `icons` é o NOME DO ÍCONE Ionicons que ele substitui.
 */
export const logo: any = null; // ex.: require('./logo.png')

export const icons: Record<string, any> = {
  // trophy: require('./icons/trophy.png'),
  // timer: require('./icons/timer.png'),
  // flag: require('./icons/flag.png'),
};
