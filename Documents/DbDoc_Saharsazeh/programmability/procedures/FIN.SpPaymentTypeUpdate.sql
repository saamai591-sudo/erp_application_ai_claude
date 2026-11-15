CREATE   PROC [FIN].[SpPaymentTypeUpdate] 
    @PaymentTypeID int,
	@Code int,
	@Type tinyint,
	@Title nvarchar(250),
	@Title2 nvarchar(250),
	@SLID int,
	@IsActive bit,
	@AnnouncedInAdditionalValue bit,
	@CompulsoryInBaseSelection bit,
	@Version int,
	@Creator int,
	@CreationDate datetime,
	@LastEditor int,
	@LastEditionDate datetime,
	@AllocationSlID int,
	@CashStructureID INT
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	IF EXISTS (SELECT 1 FROM FIN.PaymentType WHERE Title = @Title and PaymentTypeID <> @PaymentTypeID)
	BEGIN
		RAISERROR('عنوان نمی تواند تکراری باشد.',16,12)	
		RETURN	
	END

	IF EXISTS (SELECT 1 FROM FIN.PaymentType WHERE Title2 = @Title2 and PaymentTypeID <> @PaymentTypeID)
	BEGIN
		RAISERROR('عنوان2 نمی تواند تکراری باشد.',16,12)	
		RETURN	
	END

	if @Version <> (Select [Version] from [FIN].[PaymentType]
				where [PaymentTypeID] = @PaymentTypeID)
	RAISERROR('Version mismatch...', 16 , 10)

	set @Version = @Version +1 

		if (@Code is null or @Code = 0)
			set @Code = isnull((select MAX(Code) from FIN.PaymentType),0) + 1

		UPDATE [FIN].[PaymentType]
		SET    [Code] = @Code,
		       [Type] = @Type,
			   [Title] = @Title,
			   [Title2] = @Title2,
			   [SLID] = @SLID,
			   [IsActive] = @IsActive,
			   [AnnouncedInAdditionalValue] = @AnnouncedInAdditionalValue,
			   [CompulsoryInBaseSelection] = @CompulsoryInBaseSelection,
			   [Version] = @Version, 
			   [Creator] = @Creator,
			   [CreationDate] = @CreationDate, 
			   [LastEditor] = @LastEditor,
			   [LastEditionDate] = @LastEditionDate,
			   [AllocationSlID] = @AllocationSlID,
			   [CashstructureID] = @CashStructureID
		WHERE  [PaymentTypeID] = @PaymentTypeID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version] ,[Code]
		FROM   [FIN].[PaymentType]
		WHERE  [PaymentTypeID] = @PaymentTypeID	
		-- End Return Select <- do not remove
