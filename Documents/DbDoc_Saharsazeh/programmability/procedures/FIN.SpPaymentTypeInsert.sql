CREATE   PROC [FIN].[SpPaymentTypeInsert]
	@Code int,
	@Type tinyint,
	@Title nvarchar(250),
	@Title2 nvarchar(250),
	@SLID int,
	@IsActive bit,
	@AnnouncedInAdditionalValue bit,
	@CompulsoryInBaseSelection bit,
	@Creator int,
	@CreationDate datetime,
	@LastEditor int,
	@LastEditionDate datetime,
	@AllocationSlID int,
	@CashStructureID INT
--WITH ENCRYPTION
AS
	SET NOCOUNT ON 
	
	IF EXISTS (SELECT 1 FROM FIN.PaymentType WHERE Title = @Title)
	BEGIN
		RAISERROR('عنوان نمی تواند تکراری باشد.',16,12)	
		RETURN	
	END

	IF EXISTS (SELECT 1 FROM FIN.PaymentType WHERE Title2 = @Title2)
	BEGIN
		RAISERROR('عنوان2 نمی تواند تکراری باشد.',16,12)	
		RETURN	
	END
	
	if (@Code is null or @Code = 0)
		set @Code = isnull((select MAX(Code) from FIN.PaymentType),0) + 1

    INSERT INTO [FIN].[PaymentType] ([Code],[Type],[Title],[Title2],[SLID],[IsActive],
	                                 [AnnouncedInAdditionalValue],[CompulsoryInBaseSelection],
									 [Version],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[AllocationSlID],[CashstructureID])
    SELECT @Code,@Type,@Title,@Title2,@SLID,@IsActive,
	       @AnnouncedInAdditionalValue,@CompulsoryInBaseSelection,0,@Creator,@CreationDate,@LastEditor,@LastEditionDate,@AllocationSlID,@CashStructureID
	
	-- Begin Return Select <- do not remove
    SELECT  [PaymentTypeID], [Version], [Code]
    FROM    [FIN].[PaymentType]
    WHERE   [PaymentTypeID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
