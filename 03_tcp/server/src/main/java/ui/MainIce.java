package ui;

import com.zeroc.Ice.Communicator;
import com.zeroc.Ice.ObjectAdapter;
import com.zeroc.Ice.Util;
import ice.ChatServiceImpl;
import services.ChatServicesImpl;

/**
 * Servidor Ice para el sistema de chat
 * Expone el servicio ChatService via Ice RPC y WebSocket
 */
public class MainIce {

    public static void main(String[] args) {
        System.out.println("=== SERVIDOR DE CHAT ICE - Proyecto Final ===");
        System.out.println("Iniciando servidor Ice RPC + WebSocket...");
        System.out.println("=============================================\n");

        Communicator communicator = null;

        try {
            // Inicializar comunicador Ice
            communicator = Util.initialize(args);

            // Crear instancia de servicios (lógica de negocio)
            ChatServicesImpl chatServices = new ChatServicesImpl();
            System.out.println("[CHAT] Servicios de chat inicializados");

            // Crear Servant Ice (wrapper)
            ChatServiceImpl chatServiceImpl = new ChatServiceImpl(chatServices);
            System.out.println("[ICE] Servant Ice creado");

            // Crear adaptador con endpoints TCP y WebSocket
            // tcp -p 10000: Para comunicación Ice estándar
            // ws -h 0.0.0.0 -p 10001: Para WebSocket (conexión desde navegador)
            ObjectAdapter adapter = communicator.createObjectAdapterWithEndpoints(
                "ChatAdapter",
                "default -h 0.0.0.0 -p 10000:ws -h 0.0.0.0 -p 10001"
            );

            // Registrar el servant con identity "ChatService"
            adapter.add(
                chatServiceImpl,
                Util.stringToIdentity("ChatService")
            );

            // Activar adaptador
            adapter.activate();

            System.out.println("\n✅ Servidor Ice iniciado correctamente");
            System.out.println("📡 Endpoint TCP: tcp://localhost:10000");
            System.out.println("🌐 Endpoint WebSocket: ws://localhost:10001");
            System.out.println("🔑 Service Identity: ChatService");
            System.out.println("\n💡 El servidor está listo para recibir conexiones");
            System.out.println("💡 Presiona Ctrl+C para detener\n");

            // Mantener el servidor corriendo
            communicator.waitForShutdown();

        } catch (Exception e) {
            System.err.println("❌ Error en el servidor Ice:");
            e.printStackTrace();
        } finally {
            if (communicator != null) {
                try {
                    System.out.println("\n🛑 Deteniendo servidor Ice...");
                    communicator.destroy();
                    System.out.println("✅ Servidor detenido correctamente");
                } catch (Exception e) {
                    System.err.println("Error al destruir comunicador: " + e.getMessage());
                }
            }
        }
    }
}
