CREATE PROC [HRM].[SpPayrollGroupUpdate] 
    @PayrollGroupID int,
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

	if @Version <> (Select [Version] from [HRM].[PayrollGroup]
				where [PayrollGroupID] = @PayrollGroupID)
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end

	IF exists(SELECT * FROM hrm.PayrollGroup pg
	          WHERE pg.PaymentSystemId=@PaymentSystemID AND Title=@Title AND pg.PayrollGroupID<>@PayrollGroupID )
	BEGIN
		RAISERROR('عنوان گروه تکراري مي باشد.',16,12)
		RETURN
	END
	IF exists(SELECT * FROM hrm.PayrollGroup pg
	          WHERE pg.PaymentSystemId=@PaymentSystemID AND Code=@Code AND pg.PayrollGroupID<>@PayrollGroupID)
	BEGIN
		RAISERROR('کد گروه تکراري مي باشد.',16,12)
		RETURN
	END

	declare @oldValue int 

	select @OldValue=value from hrm.[PayrollGroup]
	where [PayrollGroupID] = @PayrollGroupID

	if @Value<>@OldValue
	begin
		if exists (select 1 from hrm.Agreement
		where PayrollGroupId=@PayrollGroupID)
		begin
			RAISERROR('با توجه به اينکه از اين گروه استفاده شده است امکان تغيير مقدار نمي باشد.',16,12)
			RETURN
		end
	end

	set @Version = @Version +1 

	UPDATE [HRM].[PayrollGroup]
	SET    [PaymentSystemID] = @PaymentSystemID, [Code] = @Code, [Title] = @Title, [Title2] = @Title2, [Value] = @Value, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate, [Version] = @Version
	WHERE  [PayrollGroupID] = @PayrollGroupID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version]
	FROM   [HRM].[PayrollGroup]
	WHERE  [PayrollGroupID] = @PayrollGroupID	
	-- End Return Select <- do not remove
