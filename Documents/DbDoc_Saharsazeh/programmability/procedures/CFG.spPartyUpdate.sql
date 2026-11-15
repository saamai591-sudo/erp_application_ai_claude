

CREATE   PROC [CFG].[spPartyUpdate]
    @PartyID BIGINT ,
    @Type TINYINT ,
    @Title NVARCHAR(256) ,
    @Title2 NVARCHAR(256) ,
    @IdentificationCode NVARCHAR(50) ,
    @RegisterCode  NVARCHAR(50),
    @EconomicCode NVARCHAR(50) ,
    @IsActive BIT ,
    @IsInBlackList BIT ,
    @IsCustomer BIT ,
    @CreditControl BIT ,
    @CustomerCredit DECIMAL(30, 4) ,
    @IsDetterent BIT ,
    @IntroductionName NVARCHAR(256) ,
    @IsVendor BIT ,    
    @Version INT ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @DlID BIGINT ,
    @CustomerGroupID INT ,
    @IntroductionID SMALLINT ,
    @VendorGroupID INT ,
    @ExemptFromTax BIT ,    
    @CustomerCode NVARCHAR(256) ,
    @NationalID NVARCHAR(256) ,
    @LastName NVARCHAR(256) ,
    @LastName2 NVARCHAR(256) ,
    @Email VARCHAR(250) ,
    @IsReceptionist BIT ,
    @TradeName NVARCHAR(250) ,
    @TradeName2 NVARCHAR(250),
	@IsShoppingCardExporter BIT,
    @Nationality INT ,
    @FidaCode NVARCHAR(12) ,
    @FidaIdCode NVARCHAR(12)
--WITH ENCRYPTION 
AS
SET NOCOUNT ON; 

	IF @Version <> (
	       SELECT [Version]
	       FROM   [CFG].[Party]
	       WHERE  [PartyID] = @PartyID
	   )
	    RAISERROR('Version mismatch...', 16, 10);
	
	DECLARE @OldIsCustomerStatus      BIT,
	        @OldIsSaleAgentStatus     BIT,
	        @OldIsVendorStatus        BIT,
	        @Count                    INT,
	        @Message                  NVARCHAR(MAX);
	
	SELECT @OldIsCustomerStatus = p.IsCustomer,
	       @OldIsVendorStatus = p.IsVendor
	FROM   CFG.Party p
	WHERE  p.PartyID = @PartyID;
	
	SELECT @Message = 'InformationUsed'
	
	
	--SATURNNEW-2957
	IF @IsCustomer = 1
	BEGIN
	    IF (
	           SELECT LOWER(ConfigValue)
	           FROM   [CFG].[Configuration]
	           WHERE  ConfigKey = 'SameCustomerCodeAndDlCode'
	       ) = 'true'
	    BEGIN
	        -- IF @CustomerCode IS NULL
	        BEGIN
	        	SELECT @CustomerCode = Code
	        	FROM   ACC.DL AS d
	        	WHERE  d.DLID = @DlID;
	        END;
	    END;
	END;
	UPDATE [CFG].[Party]
	SET    [Type]                       = @Type,
	       [Title]                      = @Title,
	       [Title2]                     = @Title2,
	       [IdentificationCode]         = @IdentificationCode,
	       RegisterCode                 = @RegisterCode,
	       [EconomicCode]               = @EconomicCode,
	       [IsActive]                   = @IsActive,
	       [IsInBlackList]              = @IsInBlackList,
	       [IsCustomer]                 = @IsCustomer,
	       [CreditControl]              = @CreditControl,
	       [CustomerCredit]             = @CustomerCredit,
	       [IsDetterent]                = @IsDetterent,
	       [IntroductionName]           = @IntroductionName,
	       [IsVendor]                   = @IsVendor,
	       [Version]                    = @Version + 1,
	       [LastEditor]                 = @LastEditor,
	       [LastEditionDate]            = @LastEditionDate,
	       [DlID]                       = @DlID,
	       [CustomerGroupID]            = @CustomerGroupID,
	       [IntroductionID]             = @IntroductionID,
	       [VendorGroupID]              = @VendorGroupID,
	       [ExemptFromTax]              = @ExemptFromTax,
	       [CustomerCode]               = @CustomerCode,
	       [NationalID]                 = @NationalID,
	       [LastName]                   = @LastName,
	       [LastName2]                  = @LastName2,
	       [Email]                      = @Email,
	       [IsReceptionist]             = @IsReceptionist,
	       [TradeName]                  = @TradeName,
	       [TradeName2]                 = @TradeName2,
	       [IsShoppingCardExporter]     = @IsShoppingCardExporter,
	       [Nationality]                = @Nationality,
	       [FidaCode]                   = @FidaCode,
	       [FidaIdCode]                 = @FidaIdCode
	WHERE  [PartyID]                    = @PartyID;
	
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [CFG].[Party]
	WHERE  [PartyID] = @PartyID; 
	-- End Return Select <- do not remove
