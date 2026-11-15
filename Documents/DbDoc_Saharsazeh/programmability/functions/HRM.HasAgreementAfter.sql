CREATE Function [HRM].[HasAgreementAfter](@CalendarMonthID int,@PaymentSystemID int=null)

returns bit
--with encryption
begin

	declare @StartDate Date,@ret bit

	select @StartDate=StartDate from hrm.CalendarMonth
	where CalendarMonthID=@CalendarMonthID

	if Exists (
		select 1 from hrm.Agreement
		Inner join hrm.EmploymentType
		on hrm.EmploymentType.EmploymentTypeID=hrm.Agreement.EmploymentTypeID
		where IssueDate>=@StartDate and (@PaymentSystemID is null or Hrm.EmploymentType.PaymentSystemId=@PaymentSystemID))
		set @ret=1
	Else  
		set @ret=0
	return @ret
end
