import { StyleSheet } from 'react-native'

export const colors = 
{
    yellow: '#F5CF27',
    dark: '#1a1a2e',
    green: '#085041',
    red: '#a32d2d',
    white: '#ffffff',
    gray: '#888888'
}

export const globalStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.yellow },
  title: { fontSize: 50, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.gray, marginBottom: 32 },
  btn: { backgroundColor: colors.dark, padding: 14, borderRadius: 10, width: 450, alignItems: 'center', marginBottom: 20 },
  btnText: { color: colors.white, fontSize: 50},
})