CREATE   PROC [ATN].[spPersonelRequestUpdate]
    @PersonelRequestID int,  	
	@PersonelID int,
    @Number int, 
	@Date date,
	@RequestTypeID int,
	@StartDate date,
	@EndDate date,
	@StartHour decimal(18,0),
	@EndHour decimal(18,0),
	@Description nvarchar(max),
	@Description2 nvarchar(max),
	@Status tinyint,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON
	declare @PreviousStatus tinyint

	select @PreviousStatus = [Status] 
	from ATN.PersonelRequest
	where PersonelRequestID = @PersonelRequestID

	if ((@Status = 2 and @PreviousStatus = 2) or (@Status = 3 and @PreviousStatus = 3))
	begin
		raiserror('AttendanceManagement.Messages.RequestIsNotEditable',16,12)
		return
	end

	if @Version=(Select [Version] from ATN.PersonelRequest
	where PersonelRequestID = @PersonelRequestID)
	begin	
		DECLARE @FinancialPeriodID int,
		    @StartNum  INT = NULL,
			@EndNum    INT = NULL,
			@DocumentNumID int,
			@Message NVARCHAR(MAX)

		if(@Number IS NOT NULL and @Number <> 0)
		begin
			IF EXISTS (select * from ATN.PersonelRequest
			where PersonelRequestID <> @PersonelRequestID and Number = @Number)
			begin
				raiserror('AttendanceManagement.Messages.NumberIsDuplicate',16,12)
				return
			end
		end

		IF(@Number = 0 OR @Number IS NULL)
		SET @Number =ISNULL((SELECT MAX(Number) + 1
						  FROM ATN.PersonelRequest
							 ),1)		   

		set @Version = @Version + 1 

		UPDATE ATN.PersonelRequest
		SET    Number = @Number,
		       [Date] = @Date, 
			   RequestTypeID = @RequestTypeID, 
			   StartDate = @StartDate,
	           EndDate = @EndDate,
	           StartHour = @StartHour,
	           EndHour = @EndHour,
			   PersonelID = @PersonelID,
			   [Description] = @Description,
			   Description2 = @Description2,
			   [Status] = @Status,
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  PersonelRequestID = @PersonelRequestID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version], Number
		FROM   ATN.PersonelRequest
		WHERE  PersonelRequestID = @PersonelRequestID	
		-- End Return Select <- do not remove
	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
