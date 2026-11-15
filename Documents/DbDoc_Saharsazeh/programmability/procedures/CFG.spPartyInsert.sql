

CREATE   PROC [CFG].[spPartyInsert]
    @Type TINYINT ,
    @Title NVARCHAR(256) ,
    @Title2 NVARCHAR(256) ,
    @IdentificationCode NVARCHAR(50) ,
    @RegisterCode NVARCHAR(50) ,
    @EconomicCode NVARCHAR(50) ,
    @IsActive BIT ,
    @IsInBlackList BIT ,
    @IsCustomer BIT ,
    @CreditControl BIT ,
    @CustomerCredit DECIMAL(30, 4) ,
    @IsDetterent BIT ,
    @IntroductionName NVARCHAR(256) ,
    @IsVendor BIT ,   
    @Creator INT ,
    @CreationDate DATETIME ,
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
    @TradeName2 NVARCHAR(250) ,
    @IsShoppingCardExporter BIT ,
    @Nationality INT ,
    @FidaCode NVARCHAR(12) ,
    @FidaIdCode NVARCHAR(12)
--WITH ENCRYPTION 
AS
    SET NOCOUNT ON;
    DECLARE @PartyID INT;

    INSERT INTO [CFG].[Party] ( [Type] ,
                                [Title] ,
                                [Title2] ,
                                [IdentificationCode] ,
                                RegisterCode ,
                                [EconomicCode] ,
                                [IsActive] ,
                                [IsInBlackList] ,
                                [IsCustomer] ,
                                [CreditControl] ,
                                [CustomerCredit] ,
                                [IsDetterent] ,
                                [IntroductionName] ,
                                [IsVendor] ,
                               
                                [Version] ,
                                [Creator] ,
                                [CreationDate] ,
                                [LastEditor] ,
                                [LastEditionDate] ,
                                [DlID] ,
                                [CustomerGroupID] ,
                                [IntroductionID] ,
                                [VendorGroupID] ,
                                [ExemptFromTax] ,
                                
                                [CustomerCode] ,
                                [NationalID] ,
                                [LastName] ,
                                [LastName2] ,
                                [Email] ,
                                [IsReceptionist] ,
                                [TradeName] ,
                                [TradeName2] ,
                                [IsShoppingCardExporter] ,
                                [Nationality] ,
                                [FidaCode] ,
                                [FidaIdCode] )
                SELECT @Type ,
                       @Title ,
                       @Title2 ,
                       @IdentificationCode ,
                       @RegisterCode ,
                       @EconomicCode ,
                       @IsActive ,
                       @IsInBlackList ,
                       @IsCustomer ,
                       @CreditControl ,
                       @CustomerCredit ,
                       @IsDetterent ,
                       @IntroductionName ,
                       @IsVendor ,
                       0,
                       @Creator ,
                       @CreationDate ,
                       @LastEditor ,
                       @LastEditionDate ,
                       @DlID ,
                       @CustomerGroupID ,
                       @IntroductionID ,
                       @VendorGroupID ,
                       @ExemptFromTax ,
                       @CustomerCode ,
                       @NationalID ,
                       @LastName ,
                       @LastName2 ,
                       @Email ,
                       @IsReceptionist ,
                       @TradeName ,
                       @TradeName2 ,
                       @IsShoppingCardExporter ,
                       @Nationality ,
                       @FidaCode ,
                       @FidaIdCode;

    SET @PartyID = SCOPE_IDENTITY();

    IF @DlID IS NOT NULL
       AND (   SELECT LOWER(ConfigValue)
               FROM   [CFG].[Configuration]
               WHERE  ConfigKey = 'SameCustomerCodeAndDlCode' ) = 'true'
       AND @IsCustomer = 1
        UPDATE CFG.Party
        SET    CustomerCode = d.Code
        FROM   CFG.Party p
               JOIN ACC.DL d ON d.DLID = p.DlID
        WHERE  p.PartyID = @PartyID;

    -- Begin Return Select <- do not remove
    SELECT [PartyID] ,
           [Version] 
    FROM   [CFG].[Party]
    WHERE  [PartyID] = @PartyID;
-- End Return Select <- do not remove
