
-----------------------------------------------------[CFG].spUserUpdate------------------------------
CREATE   PROC [CFG].spUserUpdate
    @UserID INT,
    @Version   int,
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
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF EXISTS
    (
        SELECT Username
        FROM CFG.[User]
        WHERE UserID = @UserID
              AND Username <> @Username
    )
    BEGIN
        DECLARE @Message NVARCHAR(1024);

        SET @Message = N' امکان ویرایش نام کاربری نمی باشد ';
        RAISERROR(@Message, 16, 12);
        RETURN 0;
    END;


    IF @PartyID IS NOT NULL
       AND EXISTS
    (
        SELECT 1
        FROM CFG.[User]
        WHERE PartyID = @PartyID
              AND UserID <> @UserID
    )
    BEGIN
        RAISERROR('BaseDataProvider.Messages.PartyUserIsCreated', 16, 12);
        RETURN 0;
    END;

    IF EXISTS
    (
        SELECT [Version]
        FROM [CFG].[User]
        WHERE [UserID] = @UserID
              AND Version = @Version
    )
    BEGIN

       IF @IsTwoFactor = 1
           AND EXISTS
        (
            SELECT 1
            FROM CFG.[User]
            WHERE UserID = @UserID
                  AND IsTwoFactor = 0
        )
            SET @TwoFactorSecretKey = NEWID();

            set @Version = @Version + 1

        UPDATE [CFG].[User]
        SET [Username] = @Username,
            [Name] = @Name,
            [Name2] = @Name2,
            [Password] = @Password,
            [IsActive] = @IsActive,
            [IsPurchaseExpert] = @IsPurchaseExpert,
            PartyID = @PartyID,
            [Creator] = @Creator,
            [CreationDate] = @CreationDate,
            [LastEditor] = @LastEditor,
            [LastEditionDate] = @LastEditionDate,
            [Version] = @Version,
            Data_Hash = @Data_Hash,
            ExternalLoginId = @ExternalLoginId,
            [IpPolicyId] = @IpPolicyId,
            [TimePolicyID] = @TimePolicyID,
            [SessionTimeOutPolicyID] = @SessionTimeOutPolicyID,
            [IsTwoFactor] = @IsTwoFactor,
            [TwoFactorSecretKey] = @TwoFactorSecretKey,
            [AccessInfo] = @AccessInfo,
            [DenyAccessInfo] = @DenyAccessInfo
        WHERE [UserID] = @UserID;

        -- Begin Return Select <- do not remove
        SELECT Version,Code
        FROM [CFG].[User]
        WHERE [UserID] = @UserID;
        -- End Return Select <- do not remove

    END;
END;
