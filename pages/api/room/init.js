import { initializeRoom } from '../../../lib/redis';
import { getClientIP } from '../../../lib/client-ip.mjs';
import { isValidRoomId } from '../../../lib/utils';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: '只允许GET请求' });
  }

  const { roomId } = req.query;
  // 获取用户IP作为一种身份标识
  const clientIP = getClientIP(req);

  if (!roomId || !isValidRoomId(roomId)) {
    return res.status(400).json({ message: '无效的房间ID' });
  }

  try {
    const { isInitiator, roomFull } = await initializeRoom(roomId, clientIP);

    if (roomFull) {
      return res.status(403).json({
        message: '房间已满，无法加入',
        roomFull: true
      });
    }
    
    return res.status(200).json({
      roomId,
      isInitiator,
      userIP: clientIP,
      message: isInitiator ? '创建了新房间' : '加入了已存在的房间'
    });
  } catch (error) {
    console.error('Room initialization error:', error);
    return res.status(500).json({ message: '服务器错误' });
  }
}
