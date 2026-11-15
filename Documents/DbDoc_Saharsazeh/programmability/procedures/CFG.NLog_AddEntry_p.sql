
CREATE   PROCEDURE [CFG].[NLog_AddEntry_p]
(
    @app NVARCHAR(200),
    @logged DATETIME,
    @level VARCHAR(50),
    @message NVARCHAR(MAX),
    @exception NVARCHAR(MAX),
    @Ip NVARCHAR(100),
    @method VARCHAR(50),
    @db VARCHAR(50),
    @url VARCHAR(1024),
    @LogType VARCHAR(50),
    @User VARCHAR(50),
    @time TIME(7),
    @processid BIGINT,
    @levelId INT,
    @LogTypeId INT,
    @EncryptLogContent BIT = 0,
    @HashLogContent BIT = 0,
    @MaxLogRecord INT = 1,
	@CategoryId INT = 0
)
AS
BEGIN

    DECLARE @Message_Hash VARBINARY(MAX),
            @Message_Encrypt VARBINARY(MAX);

    IF @EncryptLogContent = 1
    BEGIN
        OPEN SYMMETRIC KEY [Log_Key]
        DECRYPTION BY CERTIFICATE [SaamCertificate] WITH PASSWORD = 'Saam987456321';
        ;


        SET @Message_Encrypt = ENCRYPTBYKEY(   KEY_GUID('Log_Key'),
                                               CASE
                                                   WHEN @message <> ''
                                                        AND @message IS NOT NULL THEN
                                                       @message
                                                   ELSE
                                                       @exception
                                               END
                                           );

        CLOSE SYMMETRIC KEY [Log_Key];

        SET @message = NULL;
        SET @exception = NULL;
    END;



    IF @HashLogContent = 1
    BEGIN
        SET @Message_Hash = HASHBYTES(   'SHA2_256',
                                         CASE
                                             WHEN @Message_Encrypt IS NOT NULL THEN
                                                 @Message_Encrypt
                                             WHEN @message IS NOT NULL THEN
                                                 @message
                                             WHEN @exception IS NOT NULL THEN
                                                 @exception
                                             ELSE
                                                 ''
                                         END + @User + CAST(@time AS VARCHAR(20))
                                     );
    END;


    IF @MaxLogRecord IS NOT NULL
       AND @MaxLogRecord <> 0
       AND
       (
           SELECT COUNT(*) FROM CFG.NLog
       ) >= @MaxLogRecord
    BEGIN
        DELETE FROM CFG.NLog
        WHERE ID <=
        (
            SELECT MAX(ID)
            FROM
            (
                SELECT ID,
                       ROW_NUMBER() OVER (ORDER BY ID DESC) AS Rno
                FROM CFG.NLog AS n
            ) T
            WHERE T.Rno >= @MaxLogRecord
        );
    END;

    INSERT INTO CFG.[NLog]
    (
        [app],
        [Logged],
        [Level],
        [Message],
        [Exception],
        [Ip],
        method,
        db,
        [url],
        LogType,
        [time],
        processid,
        UserId,
        LevelId,
        LogTypeId,
        Message_Hash,
        Message_Encrypt,
		CategoryId
    )
    VALUES
    (@app, @logged, @level, @message, @exception, @Ip, @method, @db, @url, @LogType, @time, @processid, @User,
     @levelId, @LogTypeId, @Message_Hash, @Message_Encrypt, @CategoryId);
END;
