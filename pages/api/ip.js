import { storeIPInfo, getIPInfo } from '../../lib/redis';
import { getClientIP } from '../../lib/client-ip.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: '只允许GET请求' });
  }

  // 获取roomId和peerId参数
  const { roomId, peerId } = req.query;
  const ip = getClientIP(req);

  try {
    // 使用备用IP API (ipinfo.io)，或在出错时使用虚拟数据
    try {
      const response = await fetch(`https://ipinfo.io/${ip}/json`);
      
      if (response.ok) {
        const ipData = await response.json();
        
        // 解析经纬度坐标
        let latitude = 0;
        let longitude = 0;
        
        if (ipData.loc) {
          const [lat, lon] = ipData.loc.split(',');
          latitude = parseFloat(lat);
          longitude = parseFloat(lon);
        }
        
        // 构建IP信息对象
        const ipInfo = {
          ip: ipData.ip || ip,
          city: ipData.city || 'Unknown',
          region: ipData.region || 'Unknown',
          country_name: ipData.country || 'Unknown',
          country_code: ipData.country || 'Unknown',
          latitude: latitude,
          longitude: longitude,
          timezone: ipData.timezone || 'Unknown',
          org: ipData.org || 'Unknown'
        };
        
        // 如果提供了roomId和peerId，直接将IP信息存储到房间状态对象
        if (roomId && peerId) {
          console.log(`接收到IP请求与存储：roomId=${roomId}, peerId=${peerId}`, ipInfo);
          
          try {
            await storeIPInfo(roomId, peerId, ipInfo);
            console.log(`已存储IP信息: roomId=${roomId}, peerId=${peerId}`);
            
            // 验证存储是否成功
            const stored = await getIPInfo(roomId, peerId);
            if (!stored) {
              console.warn(`存储IP信息失败验证：roomId=${roomId}, peerId=${peerId}`);
            }
          } catch (storeError) {
            console.error(`存储IP信息失败: ${storeError.message}`);
          }
        } else {
          console.log('未提供roomId或peerId，IP信息未持久化');
        }
        
        // 返回IP信息
        return res.status(200).json(ipInfo);
      } else {
        throw new Error('Failed to fetch IP info');
      }
    } catch (error) {
      console.error('Error fetching IP info, using fallback data:', error);
      
      // 使用虚拟数据作为回退
      const fallbackIpInfo = {
        ip: ip,
        city: 'Beijing',
        region: 'Beijing',
        country_name: 'China',
        country_code: 'CN',
        latitude: 39.9042,
        longitude: 116.4074, 
        timezone: 'Asia/Shanghai',
        org: 'Local Network',
        _fallback: true
      };
      
      // 如果提供了roomId和peerId，将回退数据也存储到房间状态对象
      if (roomId && peerId) {
        try {
          await storeIPInfo(roomId, peerId, fallbackIpInfo);
          console.log(`已存储回退IP信息: roomId=${roomId}, peerId=${peerId}`);
        } catch (storeError) {
          console.error(`存储回退IP信息失败: ${storeError.message}`);
        }
      }
      
      return res.status(200).json(fallbackIpInfo);
    }
  } catch (error) {
    console.error('Error in IP handler:', error);
    
    // 返回错误信息，但包含基本IP数据保证UI不会崩溃
    return res.status(200).json({
      ip,
      error: error.message,
      city: 'Unknown',
      region: 'Unknown',
      country_name: 'Unknown',
      latitude: 0,
      longitude: 0,
      _fallback: true
    });
  }
}
