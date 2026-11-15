
--------------------------------------------[CFG].[spUserInsert]------------------------------------------------------
CREATE   PROC [CFG].[spUserInsert]
    @Username NVARCHAR(256),
    @Name NVARCHAR(512),
    @Name2 NVARCHAR(512),
    @Password NVARCHAR(512),
    @IsActive BIT,
    @IsPurchaseExpert BIT,
    @PartyID BIGINT,
    @Data_Hash NVARCHAR(512),
    @ExternalLoginId NVARCHAR(150),
    @IpPolicyId INT,
    @TimePolicyID INT,
    @SessionTimeOutPolicyID INT,
    @IsTwoFactor BIT,
    @TwoFactorSecretKey NVARCHAR(128),
    @AccessInfo NVARCHAR(MAX),
    @DenyAccessInfo NVARCHAR(MAX),
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @Code INT
    IF @PartyID IS NOT NULL
           AND EXISTS
        (
            SELECT 1
            FROM CFG.[User]
            WHERE PartyID = @PartyID
        )
        BEGIN
            RAISERROR('BaseDataProvider.Messages.PartyUserIsCreated', 16, 12);
            RETURN 0;
        END;

        SET @Code = ISNULL(
                    (
                        SELECT MAX(Code)FROM CFG.[User]
                    ),
                    0
                          ) + 1;
                              
        IF @IsTwoFactor = 1
            SET @TwoFactorSecretKey = NEWID();

        INSERT INTO [CFG].[User]
        (
            [Username],
            [Name],
            [Name2],
            [Password],
            [IsActive],
            [IsPurchaseExpert],
            PartyID,
            Code,
            [Creator],
            [CreationDate],
            [LastEditor],
            [LastEditionDate],
            [Version],
            [Data_Hash],
            [ExternalLoginId],
            [IpPolicyId],
            [TimePolicyID],
            [SessionTimeOutPolicyID],
            [IsTwoFactor],
            [TwoFactorSecretKey],
            [AccessInfo],
            [DenyAccessInfo]
        )
        SELECT @Username,
               @Name,
               @Name2,
               @Password,
               @IsActive,
               @IsPurchaseExpert,
               @PartyID,
               @Code,
               @Creator,
               @CreationDate,
               @LastEditor,
               @LastEditionDate,
               0,
               @Data_Hash,
               @ExternalLoginId,
               @IpPolicyId,
               @TimePolicyID,
               @SessionTimeOutPolicyID,
               @IsTwoFactor,
               @TwoFactorSecretKey,
               @AccessInfo,
               @DenyAccessInfo;

        -- Begin Return Select <- do not remove
        SELECT UserId,Version,Code
        FROM [CFG].[User]
        WHERE [UserID] = SCOPE_IDENTITY();
        -- End Return Select <- do not remove
END
