
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 1/22/2018 4:50:22 PM
 ************************************************************/

CREATE   PROCEDURE [CFG].[SearchNLog]
(
    @pageIndex INT = 1,
    @PageSize INT = 100,
    @LogTypes VARCHAR(100) = NULL,
    @Loglevels VARCHAR(100) = NULL,
    @userId VARCHAR(50) = NULL,
    @FromDate DATETIME = NULL,
    @ToDate DATETIME = NULL,
    @IsForFile BIT = 0,
    @Sort INT = 0,
    @App VARCHAR(50) = NULL,
    @Db VARCHAR(50) = NULL
)
AS
IF @IsForFile = 1
BEGIN
    SET @PageSize = 10000;
    SET @pageIndex = 1;
END;
ELSE
    SET @PageSize = 100;


OPEN SYMMETRIC KEY [Log_Key]
DECRYPTION BY CERTIFICATE [SaamCertificate] WITH PASSWORD = 'Saam987456321';


SELECT n.ID,
       CAST(n.Logged AS VARCHAR(50)) AS LogDate,
       n.[Level] AS [Level],
       CASE
           WHEN n.Message_Encrypt IS NULL THEN
               CASE
                   WHEN n.[Message] <> '' THEN
                       n.[Message]
                   ELSE
                       n.Exception
               END
           ELSE
               CONVERT(NVARCHAR(MAX), DECRYPTBYKEY(n.Message_Encrypt))
       END AS [Message],
       n.[Ip],
       n.[url],
       n.LogType,
       n.UserId AS UserName,
       CAST(n.[time] AS VARCHAR(50)) AS [Time],
       CAST(CASE
                WHEN n.Message_Hash IS NULL THEN
                    0
                ELSE
                    CASE
                        WHEN HASHBYTES(   'SHA2_256',
                                          CASE
                                              WHEN n.Message_Encrypt IS NOT NULL THEN
                                                  n.Message_Encrypt
                                              WHEN n.[Message] IS NOT NULL THEN
                                                  n.[Message]
                                              WHEN n.Exception IS NOT NULL THEN
                                                  n.Exception
                                              ELSE
                                                  ''
                                          END + n.UserId + CAST(n.time AS VARCHAR(20))
                                      ) = n.Message_Hash THEN
                            1
                        ELSE
                            0
                    END
            END AS BIT) AS HashOk
FROM CFG.NLog AS n
WHERE (
          @userId IS NULL
          OR @userId = ''
          OR n.UserId = @userId
      )
      AND
      (
          @Db IS NULL
          OR n.db = @Db
          OR n.db = ''
      )
      AND
      (
          @App IS NULL
          OR n.app = @App
      )
      AND
      (
          @FromDate IS NULL
          OR CAST(n.Logged AS DATE) <= @FromDate
      )
      AND
      (
          @ToDate IS NULL
          OR CAST(n.Logged AS DATE) >= @ToDate
      )
      AND
      (
          @LogTypes IS NULL
          OR n.LogTypeId IN
             (
                 SELECT value FROM CFG.R_FnCommaStr2Table(@LogTypes) AS rfcst
             )
      )
      AND
      (
          @Loglevels IS NULL
          OR n.LevelId IN
             (
                 SELECT value FROM CFG.R_FnCommaStr2Table(@Loglevels) AS rfcst
             )
      )
ORDER BY CASE @Sort
             WHEN 0 THEN
                 n.ID
             WHEN 1 THEN
                 n.[LevelId]
             WHEN 2 THEN
                 n.LogTypeId
             ELSE
                 0
         END DESC,
         CASE @Sort
             WHEN 3 THEN
                 n.UserId
             WHEN 4 THEN
                 n.Ip
         END OFFSET (@pageIndex - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;

CLOSE SYMMETRIC KEY [Log_Key];

