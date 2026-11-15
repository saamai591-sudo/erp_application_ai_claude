CREATE PROC [HRM].[SpPayrollBaseUpdate] 
    @PayrollBaseID int,
    @PaymentSystemID int,
    @Code varchar(50),
    @Title nvarchar(512),
    @Title2 nvarchar(512),
    @Value int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	if @Version <> (Select [Version] from [HRM].[PayrollBase]
				where [PayrollBaseID] = @PayrollBaseID)
	begin
	RAISERROR('Version mismatch...', 16 , 10)
	return
	end

	IF exists(SELECT * FROM hrm.PayrollBase  pg
	          WHERE pg.PaymentSystemId=@PaymentSystemID AND Title=@Title AND pg.PayrollBaseID<>@PayrollBaseID)
	BEGIN
		RAISERROR('عنوان پايه تکراري مي باشد.',16,12)
		RETURN
	END
	IF exists(SELECT * FROM hrm.PayrollBase pg
	          WHERE pg.PaymentSystemId=@PaymentSystemID AND Code=@Code AND pg.PayrollBaseID<>@PayrollBaseID)
	BEGIN
		RAISERROR('کد پايه تکراري مي باشد.',16,12)
		RETURN
	END
	
	declare @oldValue int 

	select @OldValue=value from hrm.[PayrollBase]
	where  [PayrollBaseID] = @PayrollBaseID

	if @Value<>@OldValue
	begin
		if exists (select 1 from hrm.Agreement
		where  PayrollBaseID = @PayrollBaseID)
		begin
			RAISERROR('با توجه به اينکه از اين پايه حقوقي استفاده شده است امکان تغيير مقدار نمي باشد.',16,12)
			RETURN
		end
	end

	set @Version = @Version +1 

	UPDATE [HRM].[PayrollBase]
	SET    [PaymentSystemID] = @PaymentSystemID, [Code] = @Code, [Title] = @Title, [Title2] = @Title2, [Value] = @Value, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate, [Version] = @Version
	WHERE  [PayrollBaseID] = @PayrollBaseID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version]
	FROM   [HRM].[PayrollBase]
	WHERE  [PayrollBaseID] = @PayrollBaseID	
	-- End Return Select <- do not remove
