export interface Packet {
  id: number;
  timestamp: number;
  direction: "client_to_server" | "server_to_client" | string;
  payload_hex: string;
}

export interface Rule {
  offset: number;
  length: number;
  data_type: string;
  name: string;
}
